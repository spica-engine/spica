export interface Dashboard {
  _id?: string;
  name: string;
  icon: string;
  components: Component[];
}

export interface Component {
  name: string;
  type: string;
  url: string;
}
