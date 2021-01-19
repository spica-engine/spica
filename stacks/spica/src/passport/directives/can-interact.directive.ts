import {Directive, Input, OnInit, SimpleChanges, ElementRef, Renderer2} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @Input("canInteract") action: string;
  @Input() resource: string;
}

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @Input("canInteract") action: string;
  @Input() resource: string;

  delay: number = 200;
  tooltip: HTMLElement;

  disabledNode: Node;

  constructor(
    private passport: PassportService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.setEnableState(this.action, this.resource);
  }

  ngOnDestroy() {
    if (this.disabledNode) {
      this.revertNodeBack();
    }
    this.mouseLeave();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      Object.keys(changes)
        .map(key => changes[key].firstChange)
        .some(firstChange => firstChange == false)
    ) {
      this.setEnableState(
        changes.action ? changes.action.currentValue : this.action,
        changes.resource ? changes.resource.currentValue : this.resource
      );
    }
  }

  setEnableState(action: string, resource: string) {
    this.passport
      .checkAllowed(action, resource)
      .toPromise()
      .then(allowed => {
        console.log(allowed,this.disabledNode)
        if (!allowed && !this.disabledNode) {
          this.renderer.addClass(this.elementRef.nativeElement, "ng-disabled-button");
          // we have to clear all click listeners of this element which added from another directive
          this.disabledNode = this.elementRef.nativeElement.cloneNode(true);

          const tooltipText = `${action} is required for this action.`;

          this.disabledNode.addEventListener("mouseenter", this.mouseEnter(tooltipText));

          this.disabledNode.addEventListener("mouseleave", this.mouseLeave());

          // if ngOnChanges sends a new action which will cause the change of the allowed value, we must revert old node back
          // but reverting the old node is not possible if we call 'replaceWith' method
          this.elementRef.nativeElement.parentNode.appendChild(this.disabledNode);
          this.elementRef.nativeElement.style.display = "none";
        } else if (allowed && this.disabledNode) {
          this.revertNodeBack();
        }
      });
  }

  revertNodeBack() {
    this.renderer.removeClass(this.elementRef.nativeElement, "ng-disabled-button");

    this.elementRef.nativeElement.parentNode.removeChild(this.disabledNode);
    this.elementRef.nativeElement.style.display = "unset";

    this.disabledNode = null;
  }

  mouseEnter(text: string) {
    return (event: MouseEvent) => {
      this.createTooltip(text);

      const elementPosition = (event.target as HTMLElement).getBoundingClientRect();
      this.setTooltipPosition(elementPosition);

      this.renderer.addClass(this.tooltip, "ng-tooltip-show");
    };
  }

  mouseLeave() {
    return () => {
      if (this.tooltip) {
        this.renderer.removeClass(this.tooltip, "ng-tooltip-show");
        setTimeout(() => {
          if (this.tooltip) {
            this.renderer.removeChild(document.body, this.tooltip);
            this.tooltip = null;
          }
        }, this.delay);
      }
    };
  }

  createTooltip(text: string) {
    this.tooltip = this.renderer.createElement("span");

    this.renderer.appendChild(this.tooltip, this.renderer.createText(text));

    this.renderer.addClass(this.tooltip, "ng-tooltip");

    this.renderer.setStyle(this.tooltip, "-webkit-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-moz-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "-o-transition", `opacity ${this.delay}ms`);
    this.renderer.setStyle(this.tooltip, "transition", `opacity ${this.delay}ms`);

    this.renderer.appendChild(document.body, this.tooltip);
  }

  setTooltipPosition(elementPosition: DOMRect) {
    const tooltipPosition = this.tooltip.getBoundingClientRect();

    const border = document.body.getBoundingClientRect();

    let top: number, left: number;

    // tooltip bottom must be less than border bottom
    top = Math.min(elementPosition.bottom, border.bottom - tooltipPosition.height);

    // tooltip left must be positive
    left = Math.max(elementPosition.left + (elementPosition.width - tooltipPosition.width) / 2, 0);

    // tooltip right must be less than border right
    left = left - Math.max(left + tooltipPosition.width - border.right, 0);

    this.renderer.setStyle(this.tooltip, "top", `${top}px`);
    this.renderer.setStyle(this.tooltip, "left", `${left}px`);
  }
}
