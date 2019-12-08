export interface Component {
  type: string;
  target: string;
  key: string;
}
export interface Dashboard {
  key: string;
  name: string;
  icon: string;
  components: Component[];
}
