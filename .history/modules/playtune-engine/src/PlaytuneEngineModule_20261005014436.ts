import { NativeModule, requireNativeModule } from 'expo';

declare class PlaytuneEngineModule extends NativeModule<{}> {}

export default requireNativeModule<PlaytuneEngineModule>('PlaytuneEngine');
