import pluginClickEvent from './pluginClickEvent';
import localConfig from '../confOp';
import { ref } from 'vue';
import linkIcon from '../assets/link.png';

const getExtname = (targetPath: string) => {
  const match = /(\.[^./\\]+)$/.exec(targetPath);
  return match ? match[1] : '';
};

export default ({ currentPlugin, optionsRef, openPlugin, setOptionsRef }) => {
  const clipboardFile: any = ref([]);

  const getLocalPlugins = () => window.rubick.internal.getLocalPlugins();

  const hydrateClipboardIcons = async (fileList) => {
    const nextFiles = await Promise.all(
      fileList.map(async (file) => {
        if (file?.dataUrl || !file?.path) {
          return file;
        }
        try {
          const dataUrl = await window.rubick.getFileIcon(file.path);
          return {
            ...file,
            dataUrl,
          };
        } catch {
          return file;
        }
      })
    );
    clipboardFile.value = nextFiles;
  };

  const searchFocus = (files, strict = true) => {
    const config: any = localConfig.getConfig();
    if (!config.perf.common.autoPast && strict) return;
    if (currentPlugin.value.name) return;

    const fileList = files || window.rubick.getCopyedFiles();
    if (fileList && fileList.length) {
      window.setSubInputValue({ value: '' });
      clipboardFile.value = fileList;
      void hydrateClipboardIcons(fileList);
      const localPlugins = getLocalPlugins();
      const options: any = [
        {
          name: '复制路径',
          value: 'plugin',
          icon: linkIcon,
          desc: '复制路径到剪贴板',
          click: () => {
            window.rubick.copyText(fileList.map((file) => file.path).join(','));
            window.rubick.hideMainWindow();
          },
        },
      ];

      const commonLen = fileList.filter(
        (file) => getExtname(fileList[0].path) === getExtname(file.path)
      ).length;
      if (commonLen !== fileList.length) {
        setOptionsRef(options);
        return;
      }

      if (fileList.length === 1) {
        localPlugins.forEach((plugin) => {
          const feature = plugin.features;
          if (!feature) return;
          feature.forEach((fe) => {
            const ext = getExtname(fileList[0].path);
            fe.cmds.forEach((cmd) => {
              const regImg = /\.(png|jpg|gif|jpeg|webp)$/;
              if (
                cmd.type === 'img' &&
                regImg.test(ext) &&
                fileList.length === 1
              ) {
                const option = {
                  name: cmd.label,
                  value: 'plugin',
                  icon: plugin.logo,
                  desc: fe.explain,
                  type: plugin.pluginType,
                  click: () => {
                    pluginClickEvent({
                      plugin,
                      fe,
                      cmd,
                      ext: {
                        code: fe.code,
                        type: cmd.type || 'text',
                        payload: window.rubick.readFileAsDataUrl(fileList[0].path),
                      },
                      openPlugin,
                      option,
                    });
                    clearClipboardFile();
                  },
                };
                options.push(option);
              }
              if (
                fileList.length > 1 ||
                (cmd.type === 'file' && new RegExp(cmd.match).test(ext))
              ) {
                const option = {
                  name: cmd,
                  value: 'plugin',
                  icon: plugin.logo,
                  desc: fe.explain,
                  type: plugin.pluginType,
                  click: () => {
                    pluginClickEvent({
                      plugin,
                      fe,
                      cmd,
                      option,
                      ext: {
                        code: fe.code,
                        type: cmd.type || 'text',
                        payload: fileList,
                      },
                      openPlugin,
                    });
                    clearClipboardFile();
                  },
                };
                options.push(option);
              }
            });
          });
        });
      }
      setOptionsRef(options);
      window.rubick.clearClipboard();
      return;
    }

    const clipboardType = window.rubick.readClipboardFormats();
    if (!clipboardType.length) return;
    if (clipboardType[0] === 'text/plain') {
      const contentText = window.rubick.readClipboardText();
      if (contentText.trim()) {
        clearClipboardFile();
        window.setSubInputValue({ value: contentText });
      }
      window.rubick.clearClipboard();
    }
  };

  const clearClipboardFile = () => {
    clipboardFile.value = [];
    optionsRef.value = [];
  };

  const readClipboardContent = () => {
    const dataUrl = window.rubick.readClipboardImage();
    if (!dataUrl.replace('data:image/png;base64,', '')) return;
    clipboardFile.value = [
      {
        isFile: true,
        isDirectory: false,
        path: null,
        dataUrl,
      },
    ];
    const localPlugins = getLocalPlugins();
    const options: any = [];
    localPlugins.forEach((plugin) => {
      const feature = plugin.features;
      if (!feature) return;
      feature.forEach((fe) => {
        fe.cmds.forEach((cmd) => {
          if (cmd.type === 'img') {
            const option = {
              name: cmd.label,
              value: 'plugin',
              icon: plugin.logo,
              desc: fe.explain,
              type: plugin.pluginType,
              click: () => {
                pluginClickEvent({
                  plugin,
                  fe,
                  cmd,
                  ext: {
                    code: fe.code,
                    type: cmd.type || 'text',
                    payload: dataUrl,
                  },
                  openPlugin,
                  option,
                });
                clearClipboardFile();
              },
            };
            options.push(option);
          }
        });
      });
    });
    setOptionsRef(options);
  };

  return {
    searchFocus,
    clipboardFile,
    clearClipboardFile,
    readClipboardContent,
  };
};
