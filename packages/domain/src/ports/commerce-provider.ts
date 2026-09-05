/**
 * Contratto segnaposto coerente con AD-10. La Story 6.3 lo completerà con un
 * adapter concreto (es. Shopify).
 */
export type Price = {
  amount: number;
  currency: string;
};

export type ProductRef = {
  id: string;
  price: Price;
};

export type CommerceProvider = {
  getProduct(id: string): Promise<ProductRef>;
};
