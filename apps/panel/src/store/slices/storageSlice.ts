import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { TypeDirectories, TypeDirectoryDepth } from '../../types/storage';
import { getParentPath } from '../../pages/storage/utils';
import { ROOT_PATH } from '../../pages/storage/constants';

interface StorageState {
  directory: TypeDirectories;
  currentDirectory: string;
}

const INITIAL_DIRECTORIES: TypeDirectories = [
  {
    items: undefined,
    label: "",
    fullPath: ROOT_PATH,
    currentDepth: 1,
    isActive: true,
    content: {type: "inode/directory", size: 0}
  }
];

const initialState: StorageState = {
  directory: INITIAL_DIRECTORIES,
  currentDirectory: ROOT_PATH,
};

const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    setDirectory: (state, action: PayloadAction<TypeDirectories>) => {
      state.directory = action.payload;
    },
    setCurrentDirectory: (state, action: PayloadAction<string>) => {
      state.currentDirectory = action.payload;
    },
    handleFolderClick: (state, action: PayloadAction<{
      folderName: string;
      fullPath: string;
      directoryDepth: TypeDirectoryDepth;
      wasActive: boolean;
      isFilteringOrSearching: boolean;
    }>) => {
      const { folderName, fullPath, directoryDepth, wasActive, isFilteringOrSearching } = action.payload;
      
      if (isFilteringOrSearching) return;

      if (wasActive) {
        const newDirectories = state.directory.map(dir => {
          if (dir.currentDepth !== undefined && dir.currentDepth <= directoryDepth) {
            return {
              ...dir,
              isActive: true
            };
          }

          return {
            ...dir,
            isActive: false,
            currentDepth: undefined
          };
        });
        state.directory = newDirectories;
        
        const visibleDirs = newDirectories
          .filter(dir => dir.currentDepth)
          .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0));
        const lastVisible = visibleDirs[visibleDirs.length - 1];
        state.currentDirectory = lastVisible?.fullPath || ROOT_PATH;
        return;
      }

      const depthToGive = directoryDepth + 1;
      let theDirectory = state.directory.find(dir => dir.fullPath === fullPath);
      if (!theDirectory) {
        theDirectory = {
          items: undefined,
          label: folderName,
          fullPath: fullPath,
          currentDepth: depthToGive,
          isActive: true,
          content: {type: "inode/directory", size: 0}
        };
      } else {
        theDirectory = {...theDirectory, currentDepth: depthToGive, isActive: true};
      }
      
      const ancestorPaths = new Set<string>();
      let currentPath = fullPath;

      while (currentPath !== ROOT_PATH) {
        ancestorPaths.add(currentPath);
        currentPath = getParentPath(currentPath);
      }
      ancestorPaths.add(ROOT_PATH);

      const newDirectories = state.directory.map(dir => {
        if (dir.fullPath === fullPath) {
          return theDirectory!;
        }

        if (ancestorPaths.has(dir.fullPath)) {
          const pathDepth =
            dir.fullPath === ROOT_PATH ? 1 : dir.fullPath.split("/").filter(Boolean).length + 1;
          return {
            ...dir,
            isActive: true,
            currentDepth: pathDepth as TypeDirectoryDepth
          };
        }

        return {
          ...dir,
          isActive: false,
          currentDepth: undefined
        };
      });

      if (!newDirectories.find(dir => dir.fullPath === theDirectory!.fullPath)) {
        newDirectories.push(theDirectory);
      }
      state.directory = newDirectories;
      
      // Update currentDirectory to the clicked folder
      state.currentDirectory = fullPath;
    },
    resetStorage: (state) => {
      state.directory = INITIAL_DIRECTORIES;
      state.currentDirectory = ROOT_PATH;
    },
  },
});

export const { 
  setDirectory, 
  setCurrentDirectory, 
  handleFolderClick,
  resetStorage 
} = storageSlice.actions;

// Selectors
export const selectDirectory = (state: RootState): TypeDirectories => state.storage.directory;
export const selectCurrentDirectory = (state: RootState): string => state.storage.currentDirectory;

export default storageSlice.reducer;

