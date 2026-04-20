import { ref, watch } from 'vue';
import debounce from 'lodash.debounce';
import PinyinMatch from 'pinyin-match';
import pluginClickEvent from './pluginClickEvent';
import useFocus from './clipboardWatch';

function formatReg(regStr) {
  const flags = regStr.replace(/.*\/([gimy]*)$/, '$1');
  const pattern = regStr.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
  return new RegExp(pattern, flags);
}

function normalizeAscii(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getAsciiEntries(value = '') {
  const entries: Array<{ char: string; index: number }> = [];

  Array.from(String(value)).forEach((char, index) => {
    if (/[a-z0-9]/i.test(char)) {
      entries.push({
        char: char.toLowerCase(),
        index,
      });
    }
  });

  return entries;
}

function getTokenStartBoost(candidate = '', start = 0) {
  if (start <= 0) {
    return 12;
  }

  return /[a-z0-9]/i.test(candidate[start - 1]) ? 0 : 8;
}

function getAsciiSubstringMeta(candidate, value) {
  const normalizedCandidate = normalizeAscii(candidate);
  const normalizedValue = normalizeAscii(value);

  if (!normalizedCandidate || !normalizedValue) {
    return null;
  }

  const matchStart = normalizedCandidate.indexOf(normalizedValue);
  if (matchStart === -1) {
    return null;
  }

  const asciiEntries = getAsciiEntries(candidate);
  const start = asciiEntries[matchStart]?.index;
  const end = asciiEntries[matchStart + normalizedValue.length - 1]?.index;

  if (start === undefined || end === undefined) {
    return null;
  }

  let score = 92;

  if (normalizedCandidate === normalizedValue) {
    score = 172;
  } else if (matchStart === 0) {
    score = 148;
  } else {
    score += getTokenStartBoost(candidate, start);
    score -= Math.min(matchStart, 18);
  }

  score -= Math.max(0, normalizedCandidate.length - normalizedValue.length) * 0.35;

  return {
    match: [start, end],
    score,
  };
}

function getAsciiSubsequenceMeta(candidate, value) {
  const normalizedValue = normalizeAscii(value);
  const asciiEntries = getAsciiEntries(candidate);

  if (!asciiEntries.length || !normalizedValue) {
    return null;
  }

  const queryChars = Array.from(normalizedValue);
  const matchedEntries: typeof asciiEntries = [];
  let queryIndex = 0;

  asciiEntries.forEach((entry) => {
    if (queryIndex >= queryChars.length) {
      return;
    }

    if (entry.char === queryChars[queryIndex]) {
      matchedEntries.push(entry);
      queryIndex += 1;
    }
  });

  if (queryIndex !== queryChars.length || !matchedEntries.length) {
    return null;
  }

  const start = matchedEntries[0].index;
  const end = matchedEntries[matchedEntries.length - 1].index;
  const span = end - start + 1;
  const gapPenalty = span - queryChars.length;

  let score = 78;
  score += getTokenStartBoost(candidate, start);
  score -= Math.max(0, gapPenalty) * 2;
  score -= Math.min(start, 24) * 0.9;
  score -= Math.max(0, asciiEntries.length - queryChars.length) * 0.18;

  return {
    match: [start, end],
    score,
  };
}

function getPinyinMeta(candidate, value) {
  const match = PinyinMatch.match(candidate, value);

  if (!match) {
    return null;
  }

  const span = match[1] - match[0] + 1;
  let score = 96;
  score += getTokenStartBoost(candidate, match[0]);
  score -= Math.max(0, span - String(value).length) * 1.5;
  score -= Math.min(match[0], 16) * 0.6;

  return {
    match,
    score,
  };
}

function getSearchMeta(candidate, value) {
  if (!candidate || !value) {
    return null;
  }

  return [
    getAsciiSubstringMeta(candidate, value),
    getPinyinMeta(candidate, value),
    getAsciiSubsequenceMeta(candidate, value),
  ]
    .filter(Boolean)
    .sort((prev, next) => next.score - prev.score)[0];
}

function getSearchMatch(candidate, value) {
  return getSearchMeta(candidate, value)?.match || false;
}

function getSearchScore(candidate, value) {
  return getSearchMeta(candidate, value)?.score ?? Number.NEGATIVE_INFINITY;
}

function getAppOptionMatch(plugin, value) {
  const displayName = plugin.displayName || plugin.name;
  const searchTerms = Array.isArray(plugin.searchTerms) && plugin.searchTerms.length
    ? plugin.searchTerms
    : (plugin.keyWords || []).map((keyWord) => ({
        value: keyWord,
        source: 'displayAlias',
      }));

  const sourceBoostMap = {
    displayName: 26,
    displayAlias: 16,
    executableName: 8,
    executableAlias: 4,
  };

  const bestTerm = searchTerms.reduce((best, term) => {
    const meta = getSearchMeta(term.value, value);
    if (!meta) {
      return best;
    }

    const candidate = {
      term,
      meta,
      score: meta.score + (sourceBoostMap[term.source] ?? 0),
    };

    if (!best) {
      return candidate;
    }

    if (candidate.score !== best.score) {
      return candidate.score > best.score ? candidate : best;
    }

    return String(candidate.term.value).length < String(best.term.value).length
      ? candidate
      : best;
  }, null);

  if (!bestTerm) {
    return null;
  }

  const displayMeta = getSearchMeta(displayName, value);
  const displayMatch = displayMeta?.match || bestTerm.meta.match;
  const normalizedValue = normalizeAscii(value);
  const normalizedDisplayName = normalizeAscii(displayName);
  let zIndex = bestTerm.score;

  if (displayMeta) {
    zIndex += displayMeta.score * 0.25;
  }

  if (normalizedValue && normalizedDisplayName === normalizedValue) {
    zIndex += 30;
  } else if (
    normalizedValue &&
    normalizedDisplayName.startsWith(normalizedValue)
  ) {
    zIndex += 18;
  }

  if (displayMatch && displayMatch[0] === 0) {
    zIndex += 6;
  }

  zIndex -= Math.min(displayName.length, 96) * 0.12;

  return {
    name: displayName,
    match: displayMatch,
    zIndex,
  };
}

function searchKeyValues(lists, value, strict = false) {
  return lists.filter((item) => {
    if (typeof item === 'string') {
      return !!getSearchMatch(item, value);
    }
    if (item.type === 'regex' && !strict) {
      return formatReg(item.match).test(value);
    }
    if (item.type === 'over' && !strict) {
      return true;
    }
    return false;
  });
}

const optionsManager = ({
  searchValue,
  appList,
  openPlugin,
  currentPlugin,
}) => {
  const optionsRef = ref([]) as any;

  window.rubick.internal.onGlobalShortKey((msg) => {
    const options = getOptionsFromSearchValue(msg, true);
    options[0] && options[0].click();
  });

  const getIndex = (cmd, value) => {
    const searchTarget = cmd.label || cmd;
    const score = getSearchScore(searchTarget, value);

    if (score === Number.NEGATIVE_INFINITY) {
      return score;
    }

    return score - (cmd.label ? 1.5 : 0);
  };

  const getOptionsFromSearchValue = (value, strict = false) => {
    const localPlugins = window.rubick.internal.getLocalPlugins();
    let options: any = [];
    localPlugins.forEach((plugin) => {
      const feature = plugin.features;
      if (!feature) return;
      feature.forEach((fe) => {
        const cmds = searchKeyValues(fe.cmds, value, strict);
        options = [
          ...options,
          ...cmds.map((cmd) => {
            const option = {
              name: cmd.label || cmd,
              value: 'plugin',
              icon: plugin.logo,
              desc: fe.explain,
              type: plugin.pluginType,
              match: getSearchMatch(cmd.label || cmd, value),
              zIndex: getIndex(cmd, value),
              click: () => {
                pluginClickEvent({
                  plugin,
                  fe,
                  cmd,
                  ext: cmd.type
                    ? {
                        code: fe.code,
                        type: cmd.type || 'text',
                        payload: searchValue.value,
                      }
                    : null,
                  openPlugin,
                  option,
                });
              },
            };
            return option;
          }),
        ];
      });
    });
    const appPlugins = appList.value || [];
    const descMap = new Map();
    options = [
      ...options,
      ...appPlugins
        .map((plugin) => {
          if (descMap.get(plugin)) {
            return null;
          }
          descMap.set(plugin, true);

          const appMatch = getAppOptionMatch(plugin, value);
          if (!appMatch) {
            return null;
          }

          let option: any = null;
          option = {
            ...plugin,
            name: appMatch.name,
            match: appMatch.match,
            zIndex: appMatch.zIndex,
            click: () => {
              openPlugin(plugin, option);
            },
          };
          return option;
        })
        .filter(Boolean),
    ];
    return options;
  };

  watch(searchValue, () => search(searchValue.value));
  watch(
    appList,
    () => {
      if (searchValue.value) {
        search(searchValue.value);
      }
    },
    { deep: true }
  );

  const search = debounce((value) => {
    if (currentPlugin.value.name) return;
    if (clipboardFile.value.length) return;
    if (!value) {
      optionsRef.value = [];
      return;
    }
    optionsRef.value = getOptionsFromSearchValue(value);
  }, 100);

  const setOptionsRef = (options) => {
    optionsRef.value = options;
  };

  const {
    searchFocus,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
  } = useFocus({
    currentPlugin,
    optionsRef,
    openPlugin,
    setOptionsRef,
  });

  return {
    setOptionsRef,
    options: optionsRef,
    searchFocus,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
  };
};

export default optionsManager;
