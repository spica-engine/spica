/**
 * A single hop in the related-document navigation trail. The trail is carried in
 * react-router history state (`location.state.relationStack`) so that the drawer's
 * Back button, browser back/forward, and shared deep links all stay consistent.
 */
export interface RelationStackEntry {
  bucketId: string;
  entryId: string;
}
