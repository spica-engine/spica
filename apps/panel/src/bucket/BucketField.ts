class BucketField {
  public title: string;
  private description: string;
  private index: boolean;
  private unique: boolean;
  private primary: boolean;
  private required: boolean;
  private readonly: boolean;

  constructor(
    title: string,
    description: string,
    index: boolean,
    unique: boolean,
    primary: boolean,
    required: boolean,
    readonly: boolean
  ) {
    this.title = title;
    this.description = description;
    this.index = index;
    this.unique = unique;
    this.primary = primary;
    this.required = required;
    this.readonly = readonly;
  }



}

export default class StringField extends BucketField {
  private translatable: boolean;
  private definePattern: boolean;
  private regularExpression: string;
  private makeEnumerated: boolean;
  private enumeratedValues: string[];

  constructor(
    title: string,
    description: string,
    makeEnumerated: boolean,
    enumeratedValues: string[],
    definePattern: boolean,
    regularExpression: string,
    index: boolean,
    primary: boolean,
    translatable: boolean,
    readonly: boolean,
    unique: boolean,
    required: boolean,
  ) {
    super(title, description, index, unique, primary, required, readonly);
    this.translatable = translatable;
    this.definePattern = definePattern;
    this.regularExpression = regularExpression;
    this.makeEnumerated = makeEnumerated;
    this.enumeratedValues = enumeratedValues;
  }

}

const stringFiled = new StringField(
  "title",
  "description",
  true,
  [],
  false,
  "",
  false,
  false,
  false,
  false,
  false, 
  false
);

