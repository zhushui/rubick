import { getStaticAssetPath } from '@/main/common/runtimePaths';
import { createDefaultConfigWithLogo } from './configFactory';

const createDefaultConfig = () =>
  createDefaultConfigWithLogo(`file://${getStaticAssetPath('logo.png')}`);

export default createDefaultConfig();
export { createDefaultConfig };
