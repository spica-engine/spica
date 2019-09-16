import {animate, state, style, transition, trigger} from "@angular/animations";

export function flyFromLeft(name: string) {
  return trigger(name, [
    state(
      "true",
      style({
        opacity: 1
      })
    ),
    state(
      "false",
      style({
        opacity: 0
      })
    ),
    transition("* => *", [animate("1s")])
  ]);
}
