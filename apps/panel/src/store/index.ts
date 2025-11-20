import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import authReducer from './slices/authSlice';
import storageReducer from './slices/storageSlice';
import entrySelectionReducer from './slices/entrySelectionSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    storage: storageReducer,
    entrySelection: entrySelectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [baseApi.util.resetApiState.type],
      },
    }).concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export {
  setToken,
  clearToken,
  selectToken,
  selectIsAuthenticated,
  selectParsedToken,
} from './slices/authSlice';

export {
  setDirectory,
  setCurrentDirectory,
  setSearchQuery,
  setSearchResults,
  setFilterQuery,
  handleFolderClick,
  resetStorage,
  selectDirectory,
  selectCurrentDirectory,
  selectSearchQuery,
  selectSearchResults,
  selectStorageFilterQuery,
} from './slices/storageSlice';


export {
  selectEntry,
  selectEntries,
  deselectEntry,
  deselectEntries,
  resetBucketSelection,
  resetAllSelections,
  selectSelectedEntryIds,
} from './slices/entrySelectionSlice';
