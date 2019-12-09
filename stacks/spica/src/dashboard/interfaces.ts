export interface Dashboard {
  key: string;
  name: string;
  icon: string;
  components: string[];
}

export interface Component {
  target: string;
  type: string;
  key: string;
}
