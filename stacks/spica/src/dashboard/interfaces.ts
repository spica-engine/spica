export interface Dashboard {
  _id?: string;
  name: string;
  icon: string;
  components: Component[];
}

export interface Component {
  name: string;
  url: string;
  type: string;
  ratio: string;
}

export const getEmptyDashboard = (): Dashboard => {
  return {
    name: undefined,
    icon: "leaderboard",
    components: []
  };
};

export const getEmptyComponent = (): Component => {
  return {
    name: undefined,
    url: undefined,
    type: undefined,
    ratio: "2/2"
  };
};
