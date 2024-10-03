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
  ratio: Ratio;
}

export enum Ratio {
  OneByOne = "1/1",
  OneByTwo = "1/2",
  TwoByOne = "2/1",
  TwoByTwo = "2/2",
  FourByTwo = "4/2",
  FourByFour = "4/4"
}

export function isSmallComponent(ratio: Ratio): boolean {
  return ratio == Ratio.OneByOne || ratio == Ratio.OneByTwo || ratio == Ratio.TwoByOne;
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
    ratio: Ratio.TwoByTwo
  };
};

export function fillComponentRatios(components: Component[]) {
  return components.map(c => {
    if (!c.ratio) {
      c.ratio = Ratio.TwoByTwo;
    }
    return c;
  });
}
