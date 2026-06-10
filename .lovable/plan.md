## Vista Mensual / Calendario Completo

Añadir un toggle en el horario para alternar entre vista **Semana** (actual) y vista **Mes** completo, mostrando todos los días del mes excepto los domingos. Sigue siendo posible reservar dentro de los límites actuales (máximo 10 días vista, mínimo 2h de antelación).

### Cambios en `src/components/WeeklySchedule.tsx`

1. **Toggle de vista**: Añadir botones "Semana / Mes" junto a la navegación actual.
2. **Estado nuevo**: `viewMode: "week" | "month"` y `monthOffset` para navegar entre meses.
3. **Vista Mes**:
   - Cuadrícula de calendario tipo grid (Lun–Sáb, sin Domingo → 6 columnas).
   - Cada celda muestra: número del día + indicadores compactos (ej. "3 clases", "2 reservadas", color del nivel dominante).
   - Días pasados u "Sin clases" se ven atenuados.
   - Días reservables (dentro de 10 días) destacados con borde primario.
   - Al pulsar un día → abre un Dialog con el detalle de las clases de ese día (mismo `renderDayColumn` reutilizado) y permite reservar / cancelar / lista de espera igual que en la vista semanal.
4. **Filtrado de domingos**: Excluir `day_of_week === 6` (domingo) tanto en la cuadrícula como en cualquier render.
5. **Móvil**: Vista mes funciona igual con celdas más compactas (mostrar solo número y un punto de color por nivel reservado).
6. **Navegación**: Flechas ‹ › cambian de mes en lugar de semana cuando `viewMode === "month"`.

### Detalles técnicos

- Helper nuevo `getMonthDates(offset)` en el componente: devuelve array de `Date` desde el lunes de la primera semana del mes hasta el sábado de la última semana, omitiendo domingos.
- El Dialog de detalle reutiliza la lógica de `renderDayColumn(date, dayOfWeek)` ya existente.
- Las reglas de reserva (`canBookDate`, cap por tipo, nivel bloqueado, lista de espera) no cambian.
- Recargar `bookings` y `waitlist` con rango = primer/último día visible del mes cuando `viewMode === "month"`.

### Resultado para el usuario

- Botón "Mes" muestra el calendario completo del mes actual sin domingos.
- Tocar un día abre las clases de ese día y se puede reservar si está dentro de la ventana permitida.
- Vista "Semana" sigue funcionando exactamente igual.
