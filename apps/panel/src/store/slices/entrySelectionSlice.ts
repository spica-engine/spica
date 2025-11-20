import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "..";

type EntrySelectionState = Record<string, string[]>;

const initialState: EntrySelectionState = {};

const ensureBucketState = (state: EntrySelectionState, bucketId: string): string[] => {
  if (!state[bucketId]) {
    state[bucketId] = [];
  }
  return state[bucketId];
};

const entrySelectionSlice = createSlice({
  name: "entrySelection",
  initialState,
  reducers: {
    selectEntry: (
      state,
      action: PayloadAction<{
        bucketId: string;
        entryId: string;
      }>
    ) => {
      const {bucketId, entryId} = action.payload;
      const bucketEntries = ensureBucketState(state, bucketId);
      if (!bucketEntries.includes(entryId)) {
        bucketEntries.push(entryId);
      }
    },
    selectEntries: (
      state,
      action: PayloadAction<{
        bucketId: string;
        entryIds: string[];
      }>
    ) => {
      const {bucketId, entryIds} = action.payload;
      const bucketEntries = ensureBucketState(state, bucketId);
      const existing = new Set(bucketEntries);
      entryIds.forEach(id => {
        if (!existing.has(id)) {
          bucketEntries.push(id);
        }
      });
    },
    deselectEntry: (
      state,
      action: PayloadAction<{
        bucketId: string;
        entryId: string;
      }>
    ) => {
      const {bucketId, entryId} = action.payload;
      const bucketEntries = state[bucketId];
      if (!bucketEntries) return;
      state[bucketId] = bucketEntries.filter(id => id !== entryId);
      if (state[bucketId].length === 0) {
        delete state[bucketId];
      }
    },
    deselectEntries: (
      state,
      action: PayloadAction<{
        bucketId: string;
        entryIds: string[];
      }>
    ) => {
      const {bucketId, entryIds} = action.payload;
      const bucketEntries = state[bucketId];
      if (!bucketEntries) return;
      const idsToRemove = new Set(entryIds);
      state[bucketId] = bucketEntries.filter(id => !idsToRemove.has(id));
      if (state[bucketId].length === 0) {
        delete state[bucketId];
      }
    },
    resetBucketSelection: (state, action: PayloadAction<string>) => {
      const bucketId = action.payload;
      delete state[bucketId];
    },
    resetAllSelections: () => initialState
  }
});

export const {
  selectEntry,
  selectEntries,
  deselectEntry,
  deselectEntries,
  resetBucketSelection,
  resetAllSelections
} = entrySelectionSlice.actions;

export const selectSelectedEntryIds = (state: RootState, bucketId: string): string[] =>
  state.entrySelection[bucketId] || [];

export default entrySelectionSlice.reducer;

