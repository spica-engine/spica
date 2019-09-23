import {animate, state, style, transition, trigger, stagger, query} from "@angular/animations";

export function fly(name: string) {
  return trigger(name, [
    transition("* => *", [
      query("div", style({opacity: 0, transform: "translateY(-40px)"})),
      query(
        "div",
        stagger("450ms", [
          animate("0.7s ease-out", style({opacity: 1, transform: "translateX(0)"}))
        ])
      )
    ])
  ]);
}
export function flyOne(name: string) {
  return trigger(name, [
    state("false", style({opacity: 0, transform: "translateY(-40px)"})),
    state("true", style({opacity: 1, transform: "translateX(0)"})),
    transition("* => *", [animate("0.5s")])
  ]);
}
