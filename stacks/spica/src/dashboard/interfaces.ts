export interface Dashboard {
  _id?: string;
  name: string;
  icon: string;
  components: Component[];
}

export interface Component {
  name: string;
  url: string;
}
