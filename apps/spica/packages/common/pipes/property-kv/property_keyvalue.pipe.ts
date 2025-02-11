import {KeyValue} from "@angular/common";
import {
  Injectable,
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

    const keyChanges: any = this.keyDiffer.diff(keys);

    if (keyChanges) {
      const sortedKeys = keyChanges.collection.slice();
      this.keyValues = this.keyValues.sort(
        (a, b) => sortedKeys.indexOf(a.key) - sortedKeys.indexOf(b.key)
      );
    }
    return this.keyValues;
  }
}
