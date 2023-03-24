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
  //menim elavem
  ratio: string;
}

export const getEmptyDashboard = (): Dashboard => {
  return {
    name: undefined,
    icon: "leaderboard",
    components: []
  };
};
