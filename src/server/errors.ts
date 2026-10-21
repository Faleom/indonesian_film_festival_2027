/** A problem the visitor can fix; the message is shown to them as is. */
export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
