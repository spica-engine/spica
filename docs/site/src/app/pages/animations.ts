import {animate, state, style, transition, trigger, stagger, query} from "@angular/animations";

export function fly(name: string) {
  return trigger(name, [
    state("false", style({opacity: 0})),
    state("true", style({opacity: 1})),
    transition("* => true", [
      query("div", style({opacity: 0, transform: "translateY(40px)"})),
      animate("0.01s"),
      query(
        "div",
        stagger("200ms", [
          animate("0.5s ease-out", style({opacity: 1, transform: "translateX(0)"}))
        ])
      )
    ])
  ]);
}
export function flyOne(name: string) {
  return trigger(name, [
    state("false", style({opacity: 0, transform: "translateY(40px)"})),
    state("true", style({opacity: 1, transform: "translateX(0)"})),
    transition("* => true", [animate("0.5s")])
  ]);
}
export function flyOneByOne(name: string) {
  return trigger(name, [
    state("false", style({opacity: 0})),
    state("true", style({opacity: 1})),

    transition("* => true", [
      query(":scope > *", style({opacity: 0, transform: "translateY(40px)"})),
      animate("0.01s"),
      query(
        ":scope > *",
        stagger("200ms", [
          animate("0.5s ease-out", style({opacity: 1, transform: "translateY(0)"}))
        ])
      )
    ])
  ]);
}
