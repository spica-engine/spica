import type { Property } from "src/store/api/bucketApi";

class Bucket{
    private _id: string;
   private title: string;
   private description: string;
   private icon: string;
   private primary: string;
   private readOnly: boolean;
   private history: boolean;
   private order: number;
   private category: string;
   private acl: {
    write: string;
    read: string;
   };
   private properties: {
    [key: string]: Property;
   };

   constructor(
    _id: string,
    title: string,
    description: string,
    icon: string,
    primary: string,
    readOnly: boolean,
    history: boolean,
    order: number,
    category: string,
    acl: {
        write: string;
        read: string;
    },
    properties: {
        [key: string]: Property;
    }
   ) {
    this._id = _id;
    this.title = title;
    this.description = description;
    this.icon = icon;
    this.primary = primary;
    this.readOnly = readOnly;
    this.history = history;
    this.order = order;
    this.category = category;
    this.acl = acl;
    this.properties = properties;
   }

}