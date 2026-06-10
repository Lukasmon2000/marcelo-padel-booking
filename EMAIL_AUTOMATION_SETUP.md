# Correos automáticos de reservas

Este proyecto ya viene corregido para trabajar con:

- Supabase Edge Functions
- Brevo como proveedor de email transaccional
- Recordatorio 4 horas antes de la clase
- Email de confirmación al reservar
- Email de cancelación al cancelar
- Email opcional por la mañana para las clases del día

## 1. Instalar dependencias

```bash
npm install
```

## 2. Variables del frontend

Copia `.env.example` a `.env` y rellena:

```bash
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

No metas claves privadas en `.env` del frontend.

## 3. Secrets de Supabase Edge Functions

Configura estos secrets en Supabase:

```bash
supabase secrets set BREVO_API_KEY="tu_api_key_de_brevo"
supabase secrets set BREVO_SENDER_EMAIL="correo_verificado@tudominio.com"
supabase secrets set BREVO_SENDER_NAME="Marcelo Pádel"
supabase secrets set ADMIN_EMAIL="correo_admin@tudominio.com"
supabase secrets set CRON_SECRET="un_texto_largo_aleatorio"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"
```

La `SUPABASE_SERVICE_ROLE_KEY` solo debe estar en Supabase Secrets. Nunca debe estar en React/Vite.

## 4. Aplicar migraciones

```bash
supabase db push
```

La migración añadida es:

```txt
supabase/migrations/20260610000000_email_automation_fields.sql
```

Añade campos de control para evitar duplicados:

- `confirmation_email_sent_at`
- `cancellation_email_sent_at`
- `reminder_4h_sent_at`
- `daily_summary_sent_at`
- campos `*_error` para registrar fallos

También añade una policy para que el administrador pueda cancelar reservas con `UPDATE status='cancelled'` en vez de borrarlas.

## 5. Desplegar funciones

```bash
supabase functions deploy notify-booking
supabase functions deploy notify-cancellation
supabase functions deploy send-reminders --no-verify-jwt
supabase functions deploy send-daily-summary --no-verify-jwt
```

## 6. Programar cron

### Recordatorio 4 horas antes

Ejecuta `send-reminders` cada 10 o 15 minutos.

Ejemplo de frecuencia:

```txt
*/15 * * * *
```

La función busca reservas confirmadas cuya clase empiece aproximadamente dentro de 4 horas y marca `reminder_4h_sent_at` para no duplicar correos.

### Resumen por la mañana

Ejecuta `send-daily-summary` una vez al día, por ejemplo a las 08:00 de España.

```txt
0 8 * * *
```

## 7. Endpoints de funciones

Sustituye `PROJECT_REF` por tu referencia real de Supabase:

```txt
https://PROJECT_REF.supabase.co/functions/v1/send-reminders
https://PROJECT_REF.supabase.co/functions/v1/send-daily-summary
```

Las funciones cron están protegidas con `CRON_SECRET`, no con sesión de usuario. Cuando las llames desde cron, añade el header:

```txt
x-cron-secret: TU_CRON_SECRET
```

## 8. Qué se ha corregido

- `WeeklySchedule.tsx`: ahora guarda el `bookingId` al reservar y llama a `notify-booking`.
- `WeeklySchedule.tsx`: al cancelar llama a `notify-cancellation`.
- `MyBookings.tsx`: al cancelar llama a `notify-cancellation`.
- `AdminPanel.tsx`: el admin ya no borra reservas; las cancela con `status='cancelled'`.
- `supabase-helpers.ts`: la reserva mínima para el mismo día pasa de 2h reales a 4h reales.
- `send-reminders`: ahora envía el aviso 4 horas antes, no simplemente “mañana”.
- `send-daily-summary`: función opcional para mandar recordatorio por la mañana.
- `.gitignore`: ahora ignora `.env` y `.env.*`.

## 9. Limitación importante

No puedo comprobar el envío real de correos sin tus secrets reales de Supabase y Brevo. El proyecto queda preparado, pero debes configurar secrets, desplegar funciones y programar cron en tu Supabase.
