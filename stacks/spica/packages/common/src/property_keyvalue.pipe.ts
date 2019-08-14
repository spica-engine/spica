import {
  Pipe,
  PipeTransform,
  Injectable,
  KeyValueDiffer,
  KeyValueDiffers,
  KeyValueChanges
} from "@angular/core";
import {KeyValue} from "@angular/common";

@Injectable()
@Pipe({
  name: "propertyKv",
  pure: false
})
export class PropertyKvPipe implements PipeTransform {
  private differ: KeyValueDiffer<any, any>;
  private keyValues: Array<KeyValue<any, any>> = [];
  constructor(private readonly differs: KeyValueDiffers) {}

  transform<V>(
    value: Array<any>,
    register: (fn: Function) => void = () => {}
  ): Array<KeyValue<string, V>> {
    if (!value) {
      return [];
    }
    if (!this.differ) {
      this.differ = this.differs.find(value).create();
    }

    const differChanges: KeyValueChanges<string, V> | null = this.differ.diff(value);

    if (differChanges) {
      register(() => {
        this.differ = undefined;
      });
      return (this.keyValues = Object.entries(value).map(([key, value]) => ({key, value})));
    }

    return this.keyValues;
  }
}
