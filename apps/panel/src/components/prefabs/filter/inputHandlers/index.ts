/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { filterInputHandlerRegistry } from './FilterInputHandlerRegistry';
import StringInputHandler from './StringInputHandler';
import NumberInputHandler from './NumberInputHandler';
import RelationInputHandler from './RelationInputHandler';  

import ObjectInputHandler from './ObjectInputHandler';

filterInputHandlerRegistry.register('string', StringInputHandler);
filterInputHandlerRegistry.register('number', NumberInputHandler);
filterInputHandlerRegistry.register('relation', RelationInputHandler);

filterInputHandlerRegistry.register('object', ObjectInputHandler);
filterInputHandlerRegistry.registerDefault(StringInputHandler);
