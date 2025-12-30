/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { filterInputHandlerRegistry } from './FilterInputHandlerRegistry';
import StringInputHandler from './StringInputHandler';
import NumberInputHandler from './NumberInputHandler';
import RelationInputHandler from './RelationInputHandler';  
import ArrayInputHandler from './ArrayInputHandler';

filterInputHandlerRegistry.register('string', StringInputHandler);
filterInputHandlerRegistry.register('number', NumberInputHandler);
filterInputHandlerRegistry.register('relation', RelationInputHandler);
filterInputHandlerRegistry.register('array', ArrayInputHandler);

filterInputHandlerRegistry.registerDefault(StringInputHandler);
