#!/usr/bin/env node

const {program} = require("@caporal/core");

program
  .command("order", "Order a pizza")
  .argument("<type>", "Type of pizza")
  .option("-e, --extra-ingredients <ingredients>", "Extra ingredients")
  .action(({logger, args, options}) => {
    logger.info("Order received: %s", args.type);
    if (options.extraIngredients) {
      logger.info("Extra: %s", options.extraIngredients);
    }
  })

  .command("cancel", "Cancel an order")
  .argument("<order-id>", "Order id")
  .action(({logger, args}) => {
    logger.info("Order canceled: %s", args.orderId);
  });

program.run();

/**
 *
 * # order a margherita with pepperoni on top
 * ./pizza-hit.js order margherita -e pepperoni
 *
 * # cancel an order
 * ./pizza-hit.js cancel 12345
 *
 */
