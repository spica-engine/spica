/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { filterInputHandlerRegistry } from './FilterInputHandlerRegistry';
import StringInputHandler from './StringInputHandler';
import NumberInputHandler from './NumberInputHandler';

filterInputHandlerRegistry.register('string', StringInputHandler);
filterInputHandlerRegistry.register('number', NumberInputHandler);


filterInputHandlerRegistry.registerDefault(StringInputHandler);
