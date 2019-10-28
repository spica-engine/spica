/**
 * Used to launch the application under Bazel production mode.
 */
import {enableProdMode} from '@angular/core';
import {platformBrowser} from '@angular/platform-browser';
import {AppModule} from './src/app.module';

enableProdMode();
platformBrowser().bootstrapModule(AppModule);
