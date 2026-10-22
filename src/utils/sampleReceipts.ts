import { RawReceiptResponse } from '../types';

export const SAMPLE_RECEIPTS: Array<{
  name: string;
  description: string;
  data: RawReceiptResponse;
}> = [
  {
    name: 'Bella Italia Trattoria',
    description: 'Dinner with pizzas, pasta, wine, and dessert',
    data: {
      restaurant: 'Bella Italia Trattoria',
      items: [
        { name: 'Crispy Calamari', price: 14.50, quantity: 1 },
        { name: 'Wood-Fired Margherita Pizza', price: 18.00, quantity: 1 },
        { name: 'Truffle Mushroom Rigatoni', price: 22.50, quantity: 1 },
        { name: 'House Chianti Glass', price: 24.00, quantity: 2 }, // 2 @ 12.00 = 24.00 line total
        { name: 'Classic Tiramisu', price: 9.00, quantity: 1 },
        { name: 'San Pellegrino Sparkling', price: 5.50, quantity: 1 },
      ],
      subtotal: 93.50,
      tax: 8.42,
      tip_included: null,
      total: 101.92,
      currency: '$',
      confidence: 'high',
    },
  },
  {
    name: 'Cantina Del Sol',
    description: 'Tacos, nachos, and margaritas with gratuity included',
    data: {
      restaurant: 'Cantina Del Sol',
      items: [
        { name: 'Loaded Guacamole & Chips', price: 12.00, quantity: 1 },
        { name: 'Birria Quesatacos (3pc)', price: 17.50, quantity: 1 },
        { name: 'Baja Fish Tacos', price: 16.00, quantity: 1 },
        { name: 'House Agave Margarita', price: 26.00, quantity: 2 },
        { name: 'Churros con Chocolate', price: 8.50, quantity: 1 },
      ],
      subtotal: 80.00,
      tax: 7.20,
      tip_included: 14.40, // 18% auto gratuity
      total: 101.60,
      currency: '$',
      confidence: 'high',
    },
  },
];
