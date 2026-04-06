"use client";

import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import type {
  CreateOrderData,
  CreateOrderActions,
  OnApproveActions,
  OnApproveData,
} from "@paypal/paypal-js";
import { paypalCheckPayment, setTransactionId } from "@/actions";

interface Props {
  orderId: string;
  amount: number;
}

export const PayPalButton = ({ orderId, amount }: Props) => {
  const [{ isPending }] = usePayPalScriptReducer();


  if (isPending) {
    return (
      <div className="animate-pulse mb-16">
        <div className="h-11 bg-gray-300 rounded" />
        <div className="h-11 bg-gray-300 rounded mt-2" />
      </div>
    );
  }

  const createOrder = async (
    data: CreateOrderData,
    actions: CreateOrderActions,
  ): Promise<string> => {
    try {
      console.log("Creando orden en PayPal con monto:", amount.toFixed(2));
      const transactionId = await actions.order.create({
        intent: "CAPTURE",
        purchase_units: [
          {
            invoice_id: orderId,
            amount: {
              value: amount.toFixed(2),
              currency_code: "USD",
            },
          },
        ],
      });

      const { ok } = await setTransactionId(orderId, transactionId);
      if (!ok) {
        throw new Error("No se pudo actualizar la orden");
      }
      console.log("transactionId obtenido:", transactionId);
      return transactionId;
    } catch (error) {
      console.error("🚀 Error creando la orden de PayPal:", error);
      throw error;
    }
  };

  const onApprove = async (data: OnApproveData, actions: OnApproveActions) => {
    console.log("onApprove", { data });
    const details = await actions.order?.capture();
    if (!details) return;

    try {
      const { ok, message } = await paypalCheckPayment(details.id!);

      if (!ok) {
        // Falló en nuestro backend (ej. BD caída) aunque PayPal sí cobró
        console.error("🔥 Error validando el pago en el servidor:", message);
        alert(`Atención: Tu pago en PayPal se realizó, pero no pudimos actualizar la orden en nuestro sistema. Detalles: ${message}`);
        return;
      }

      // ¡Todo salió perfecto! El server Action ejecutará revalidatePath y actualizará la UI a "Pagada"
      console.log("✅ Pago registrado en base de datos de manera exitosa!");
      
    } catch (error) {
      console.error("🔥 Error crítico al contactar el servidor para verificar pago", error);
      alert("Hubo un error interno al verificar tu pago. Por favor contacta a soporte técnico.");
    }
  };

  return (
    <PayPalButtons
      createOrder={createOrder}
      onApprove={onApprove}
      onError={(err) => console.error("PayPal onError:", err)}
      onCancel={() => console.log("PayPal: pago cancelado por el usuario")}
    />
  );
};
