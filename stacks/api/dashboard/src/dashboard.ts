export interface Component {
  type: string;
  url: string;
  key: string;
}
export interface Dashboard {
  key: string;
  name: string;
  icon: string;
  components: Component[];
}
