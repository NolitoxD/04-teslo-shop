import type { CartProduct } from "@/interfaces";
import { create } from "zustand";
import type { StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface State {
  cart: CartProduct[];

  getTotalItems: () => number;
  getSummaryInformation: () => {
    subTotal: number;
    tax: number;
    total: number;
    itemsInCart: number;
    totalItems: number
  };

  addProductTocart: (product: CartProduct) => void;
  updateProductQuantity: (product: CartProduct, quantity: number) => void;
  removeProduct: (product: CartProduct) => void;
  clearCart: () => void;
}

const cartStore: StateCreator<State> = (set, get) => ({
  cart: [],

  // Methods
  getTotalItems: () => {
    const { cart } = get();
    return cart.reduce((total, item) => total + item.quantity, 0);
  },

  getSummaryInformation: () => {
    const { cart, getTotalItems } = get();

    const subTotal = cart.reduce(
      (subTotal, product) => product.quantity * product.price + subTotal,
      0
    );
    const tax = subTotal * 0.15;
    const total = subTotal + tax;
    const itemsInCart = cart.reduce(
      (total, item) => total + item.quantity,
      0
    );
    const totalItems = getTotalItems();

    return {
      subTotal,
      tax,
      total,
      itemsInCart,
      totalItems, 
    };
  },

  addProductTocart: (product: CartProduct) => {
    
    const { cart } = get();

    // 1. Revisar si el producto existe en el carrito con la talla seleccionada
    const productInCart = cart.some(
      (item) => item.id === product.id && item.size === product.size
    );

    if (!productInCart) {
      set({ cart: [...cart, product] });
      return;
    }

    // 2. Se que el producto existe por talla... tengo que incrementar
    const updatedCartProducts = cart.map((item) => {
      if (item.id === product.id && item.size === product.size) {
        return { ...item, quantity: item.quantity + product.quantity };
      }

      return item;
    });

    set({ cart: updatedCartProducts });
  },

  updateProductQuantity: (product: CartProduct, quantity: number) => {
    const { cart } = get();

    const updatedCartProducts = cart.map((item) => {
      if (item.id === product.id && item.size === product.size) {
        return { ...item, quantity: quantity };
      }
      return item;
    });

    set({ cart: updatedCartProducts });
  },

  removeProduct: (product: CartProduct) => {
    const { cart } = get();
    const updatedCartProducts = cart.filter(
      (item) => item.id !== product.id || item.size !== product.size
    );

    set({ cart: updatedCartProducts });
  },

  clearCart: () => {
    set({ cart: [] });
  },
});

export const useCartStore = create<State>()(
  devtools(
    persist(cartStore, { name: "shopping-cart" }),
    {
      name: "CartStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
