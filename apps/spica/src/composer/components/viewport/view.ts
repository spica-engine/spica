/**
 * This file should keep synchorized with angular repository
 */

// https://github.com/angular/angular/blob/master/packages/core/src/render3/interfaces/view.ts
export const HOST = 0;
export const TVIEW = 1;
export const FLAGS = 2;
export const PARENT = 3;
export const NEXT = 4;
export const QUERIES = 5;
export const T_HOST = 6;
export const BINDING_INDEX = 7;
export const CLEANUP = 8;
export const CONTEXT = 9;
export const INJECTOR = 10;
export const RENDERER_FACTORY = 11;
export const RENDERER = 12;
export const SANITIZER = 13;
export const CHILD_HEAD = 14;
export const CHILD_TAIL = 15;
export const CONTENT_QUERIES = 16;
export const DECLARATION_VIEW = 17;
export const PREORDER_HOOK_FLAGS = 18;
/** Size of LView's header. Necessary to adjust for it when setting slots.  */
export const HEADER_OFFSET = 20;

// https://github.com/angular/angular/blob/master/packages/core/src/render3/interfaces/container.ts

/**
 * Special location which allows easy identification of type. If we have an array which was
 * retrieved from the `LView` and that array has `true` at `TYPE` location, we know it is
 * `LContainer`.
 */
export const TYPE = 1;
/**
 * Below are constants for LContainer indices to help us look up LContainer members
 * without having to remember the specific indices.
 * Uglify will inline these when minifying so there shouldn't be a cost.
 */
export const ACTIVE_INDEX = 2;
// PARENT, NEXT, and QUERIES are indices 3, 4, and 5.
// As we already have these constants in LView, we don't need to re-create them.
export const VIEWS = 6;
export const NATIVE = 7;
