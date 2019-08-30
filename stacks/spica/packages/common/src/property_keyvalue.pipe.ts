import {KeyValue} from "@angular/common";
import {
  Injectable,
  IterableChanges,
  IterableDiffer,
  IterableDiffers,
  KeyValueChanges,
  KeyValueDiffer,
  KeyValueDiffers,
  Pipe,
  PipeTransform
} from "@angular/core";

@Injectable()
@Pipe({
  name: "propertyKv",
  pure: false
})
export class PropertyKvPipe implements PipeTransform {
  private differ: KeyValueDiffer<any, any>;
  private keyValues: Array<KeyValue<any, any>> = [];

  private keyDiffer: IterableDiffer<string>;

  constructor(
    private readonly differs: KeyValueDiffers,
    private iterableDiffers: IterableDiffers
  ) {}

  transform<V>(value: Object): Array<KeyValue<string, V>> {
    if (!value) {
      return [];
    }

    if (!this.differ) {
      this.differ = this.differs.find(value).create();
    }

    const differChanges: KeyValueChanges<string, V> | null = this.differ.diff(value);

    if (differChanges) {
      return (this.keyValues = Object.entries(value).map(([key, value]) => ({key, value})));
    }

    const keys = Object.entries(value).map(([key]) => key);

    if (!this.keyDiffer) {
      this.keyDiffer = this.iterableDiffers.find(keys).create();
    }

    const keyChanges: IterableChanges<string> = this.keyDiffer.diff(keys);

    if (keyChanges) {
      keyChanges.forEachMovedItem(change => {
        const item = this.keyValues[change.previousIndex];

        this.keyValues.splice(change.previousIndex, 1);

        this.keyValues.splice(change.currentIndex, 0, item);
      });
    }
    return this.keyValues;
  }
}
