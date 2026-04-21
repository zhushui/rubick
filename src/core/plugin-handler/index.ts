import {
  AdapterHandlerOptions,
  AdapterInfo,
} from '@/core/plugin-handler/types';
import fs from 'fs-extra';
import path from 'path';
import got from 'got';
import fixPath from 'fix-path';
import { ipcRenderer } from 'electron';
import axios from 'axios';
import {
  createPluginInstaller,
  ensurePluginWorkspaceManifest,
  repairPluginWorkspacePackages,
} from './npmAdapter';

fixPath();

class AdapterHandler {
  public baseDir: string;
  readonly registry: string;

  pluginCaches = {};

  constructor(options: AdapterHandlerOptions) {
    ensurePluginWorkspaceManifest(options.baseDir);
    repairPluginWorkspacePackages(options.baseDir);
    this.baseDir = options.baseDir;

    let register = options.registry || 'https://registry.npmmirror.com';

    try {
      const dbdata = ipcRenderer.sendSync('msg-trigger', {
        type: 'dbGet',
        data: { id: 'rubick-localhost-config' },
      });
      register = dbdata.data.register;
    } catch {
      // ignore
    }

    this.registry = register || 'https://registry.npmmirror.com/';
  }

  async upgrade(name: string): Promise<void> {
    const packageJSON = JSON.parse(
      fs.readFileSync(`${this.baseDir}/package.json`, 'utf-8')
    );
    const registryUrl = `https://registry.npmmirror.com/${name}`;

    try {
      const installedVersion = packageJSON.dependencies[name].replace('^', '');
      let latestVersion = this.pluginCaches[name];
      if (!latestVersion) {
        const { data } = await axios.get(registryUrl, { timeout: 2000 });
        latestVersion = data['dist-tags'].latest;
        this.pluginCaches[name] = latestVersion;
      }
      if (latestVersion > installedVersion) {
        await this.install([name], { isDev: false });
      }
    } catch {
      // ignore plugin upgrade failures to avoid blocking the UI
    }
  }

  async getAdapterInfo(
    adapter: string,
    adapterPath: string
  ): Promise<AdapterInfo> {
    const infoPath =
      adapterPath ||
      path.resolve(this.baseDir, 'node_modules', adapter, 'plugin.json');

    if (await fs.pathExists(infoPath)) {
      return JSON.parse(fs.readFileSync(infoPath, 'utf-8')) as AdapterInfo;
    }

    const resp = await got.get(
      `https://cdn.jsdelivr.net/npm/${adapter}/plugin.json`
    );
    return JSON.parse(resp.body) as AdapterInfo;
  }

  async install(adapters: Array<string>, options: { isDev: boolean }) {
    const installCmd = options.isDev ? 'link' : 'install';
    await this.execCommand(installCmd, adapters);
  }

  async update(...adapters: string[]) {
    await this.execCommand('update', adapters);
  }

  async uninstall(adapters: string[], options: { isDev: boolean }) {
    const installCmd = options.isDev ? 'unlink' : 'uninstall';
    await this.execCommand(installCmd, adapters);
  }

  async list() {
    const installInfo = JSON.parse(
      await fs.readFile(`${this.baseDir}/package.json`, 'utf-8')
    );
    const adapters: string[] = [];
    for (const adapter in installInfo.dependencies) {
      adapters.push(adapter);
    }
    return adapters;
  }

  private async execCommand(cmd: string, modules: string[]): Promise<string> {
    return new Promise((resolve: any, reject: any) => {
      let args: string[] = [cmd].concat(
        cmd !== 'uninstall' && cmd !== 'link'
          ? modules.map((moduleName) => `${moduleName}@latest`)
          : modules
      );

      if (cmd !== 'link') {
        args = args
          .concat('--color=always')
          .concat('--save')
          .concat(`--registry=${this.registry}`);
      }

      const npm = createPluginInstaller(args, this.baseDir);

      let output = '';
      npm.stdout
        .on('data', (data: string) => {
          output += data;
        })
        .pipe(process.stdout);

      npm.stderr
        .on('data', (data: string) => {
          output += data;
        })
        .pipe(process.stderr);

      npm.on('close', (code: number) => {
        if (!code) {
          repairPluginWorkspacePackages(this.baseDir);
          resolve({ code: 0, data: output });
          return;
        }

        reject({ code, data: output });
      });
    });
  }
}

export default AdapterHandler;
