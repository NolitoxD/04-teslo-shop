import { NextResponse } from 'next/server';
import { getPayPalBearerToken } from '@/actions/payments/paypal-check-payment';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // 1. Extraer los headers requeridos por PayPal para verificar la firma
    const bodyText = await req.text();
    const headers = req.headers;
    
    // PayPal envía sus headers en minúsculas en entornos Node/Next.js
    const transmissionId = headers.get('paypal-transmission-id') || '';
    const transmissionTime = headers.get('paypal-transmission-time') || '';
    const certUrl = headers.get('paypal-cert-url') || '';
    const authAlgo = headers.get('paypal-auth-algo') || '';
    const transmissionSig = headers.get('paypal-transmission-sig') || '';
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return NextResponse.json({ error: 'Faltan Headers de PayPal' }, { status: 400 });
    }

    // 2. Obtener Token de Acceso para llamar a la API
    const accessToken = await getPayPalBearerToken();
    if (!accessToken) {
      console.error('Webhook Error: No se pudo obtener el Access Token de PayPal');
      return NextResponse.json({ error: 'Error interno obteniendo token' }, { status: 500 });
    }

    const bodyJson = JSON.parse(bodyText);

    // 3. Llamar a PayPal para verificar matemáticamente que este POST es legítimo
    const verifyRequestUrl = process.env.PAYPAL_WEBHOOK_VERIFY_URL || '';
    
    if (!verifyRequestUrl) {
      console.error('Webhook Error: Falta configurar PAYPAL_WEBHOOK_VERIFY_URL en .env');
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
    }
    
    const verifyPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: bodyJson,
    };

    const verifyResp = await fetch(verifyRequestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(verifyPayload),
    });

    const verifyData = await verifyResp.json();

    // Si la firma matemática no coincide, es un request falso
    if (verifyData.verification_status !== 'SUCCESS') {
      console.error('Webhook Error: Verificación de firma ha fallado', verifyData);
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    console.log('✅ Webhook verificado correctamente. Evento:', bodyJson.event_type);

    // 4. Procesar la actualización de la Base de Datos
    if (bodyJson.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureData = bodyJson.resource;
      // Extraemos el invoice_id que enviábamos desde el botón (ej. uuid_0.12312)
      const invoiceId = captureData.invoice_id; 

      if (invoiceId) {
        // Obtenemos el ID real de la orden separándolo por el guion bajo
        const orderId = invoiceId.split('_')[0];
        
        await prisma.order.update({
          where: { id: orderId },
          data: {
            isPaid: true,
            paidAt: new Date(),
          }
        });
        
        console.log(`✅ Orden ${orderId} marcada como pagada silenciosamente gracias al Webhook!`);
      } else {
        console.warn('Webhook Warning: invoice_id no fue encontrado en este pago.');
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook Handler Error:', error);
    // Debemos devolver 500 para que PayPal re-intente enviar el evento más tarde
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
