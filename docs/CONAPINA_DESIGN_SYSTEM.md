# Sistema visual CONAPINA para WEB_SIGEDI_V2

Este documento concentra los criterios reutilizables de identidad visual aplicados en UI-01. La paleta y la tipografía fueron verificadas contra las páginas 4, 5 y 6 del manual institucional y se consolidan aquí para evitar reprocesar el PDF en fases posteriores.

## Paleta y tokens

Los tokens canónicos están declarados en `src/index.css`:

| Uso | Token CSS | Valor |
| --- | --- | --- |
| Navy institucional | `--conapina-navy` | `#073B57` |
| Azul principal | `--conapina-blue` | `#087CAD` |
| Azul secundario | `--conapina-blue-secondary` | `#0A6F9D` |
| Foco | `--conapina-focus` | `#1591BF` |
| Azul suave | `--conapina-blue-soft` | `#E9F6FB` |
| Azul suave 2 | `--conapina-blue-soft-2` | `#DFF1F8` |
| Bordes | `--conapina-border` | `#D7E4EA` |
| Texto | `--conapina-text` | `#17313F` |
| Texto secundario | `--conapina-text-secondary` | `#687B86` |
| Fondo | `--conapina-background` | `#F6F9FB` |
| Blanco | `--conapina-white` | `#FFFFFF` |
| Shell oscuro | `--conapina-shell-dark` | `#062634` |
| Workspace inicial | `--conapina-workspace-start` | `#004A6C` |
| Workspace medio | `--conapina-workspace-middle` | `#006B96` |
| Workspace final | `--conapina-workspace-end` | `#1285B1` |
| Sidebar | `--conapina-sidebar` | `#E8F3F7` |
| Superficie | `--conapina-surface` | `#F5FAFB` |
| Contadores | `--conapina-counter` | `#D9EEF6` |
| Éxito | `--conapina-success` | `#198754` |
| Error | `--conapina-error` | `#BD3C45` |
| Advertencia | `--conapina-warning` | `#D79616` |
| Acción crítica | `--conapina-critical` | `#E2404E` |

Los colores de éxito, error, advertencia y acción crítica se reservan exclusivamente para comunicar esos estados. No deben usarse como decoración ni como variantes de marca.

## Tipografía

La familia base es `"Segoe UI", Inter, Arial, sans-serif`, sin descargar fuentes externas.

- Título principal: 24-26 px, peso 800-900.
- Título destacado: 21-23 px, peso 900.
- Títulos secundarios: 13-16 px, peso 800-900.
- Texto normal: 12-13 px.
- Labels: 9-11 px, peso 800-900.
- Texto auxiliar: 8-10 px.

Debe mantenerse un interlineado legible, contraste suficiente y una jerarquía tipográfica breve. Los textos de marca sobre el gradiente usan blanco o blanco con opacidad alta; el texto funcional usa los tokens de texto sobre superficies claras.

## Reglas visuales

- Usar el gradiente institucional `linear-gradient(108deg, #004A6C, #006B96 58%, #1285B1)` en áreas de identidad o workspace, no en estados semánticos.
- Conservar los logotipos sin recolorear, recortar, deformar ni alterar su transparencia. Mantener proporciones naturales.
- Aplicar radios entre 8 y 14 px, bordes suaves y sombras discretas.
- Mantener transiciones funcionales entre 150 y 220 ms. Respetar `prefers-reduced-motion`.
- Mostrar foco visible para navegación por teclado y no depender únicamente del color para identificar errores o carga.
- Mantener una composición institucional sobria, sin ornamentos ni animaciones que compitan con la tarea principal.
- Adaptar las áreas a una sola columna en pantallas estrechas y evitar desplazamiento horizontal desde 320 px.

## Alcance de UI-01

La implementación inicial aplica estos criterios únicamente al Login. Los tokens quedan disponibles para reutilización controlada, pero su adopción en otras vistas debe realizarse en fases posteriores sin modificar sus contratos funcionales.

## Shell y workspace (UI-03)

- El shell autenticado utiliza un encabezado horizontal persistente de 58 px con `--conapina-shell-dark`, marca e identidad real de la sesión. Sus bordes exteriores permanecen rectos.
- Los módulos reutilizan un único Hero compacto con el gradiente institucional, radio de 16–20 px y decoración circular discreta. Solo cambian la etiqueta, el título y la descripción de cada módulo.
- Los KPI procedentes de servicios deben distinguir carga, error y cero válido. Nunca se presenta `0` como sustituto de una consulta fallida.
- El cambio entre módulos anima una sola vez el panel completo durante 200 ms, con opacidad y desplazamiento vertical de 6 px; el shell y el sidebar permanecen estáticos y `prefers-reduced-motion` desactiva el efecto.

### Donativos Monetarios (DON-MON-01)

- El módulo utiliza la ruta frontend `/donativos-monetarios` dentro del shell autenticado y reutiliza el Hero, las tarjetas KPI y el panel de listado existentes.
- El formulario inicial utiliza `/donativos-monetarios/registro`, conserva el shell y presenta una pestaña tipo carpeta para la Sección 1 con Tipo de gestión y Nombre del proyecto.
- La Sección 2, “Detalle de Recibo de Donación Monetaria”, incorpora lugar, hora y fecha de entrega, monto USD, centro de destino y objetivo; las pestañas conservan temporalmente el estado al navegar con Anterior y Siguiente.
- La Sección 3, “Información del Donante”, incorpora nombre, cargo, DUI con formato local `00000000-0`, entidad, medio de entrega y propósito; sus campos son opcionales y comparten el estado temporal de las secciones anteriores.
- La Sección 4, “Información de Recepción de Donación”, reutiliza los catálogos autenticados de Representantes UPC y Encargados de Recepción; muestra nombres completos y conserva sus identificadores únicamente en el estado temporal del formulario.
- La Sección 5, “Detalle de Acta de Recepción de Donación”, incorpora marco, entidad, objetivo, entrega, distribución, fecha del acuerdo y una ciudad obtenida del catálogo autenticado existente; todos los valores permanecen en estado frontend.
- La Sección 6, “Registro Fotográfico”, conserva localmente hasta dos imágenes JPG, JPEG o PNG de máximo 10 MB, con vista previa, reemplazo y eliminación; no realiza cargas ni simula persistencia.
- Mientras no exista integración, los indicadores muestran `—` y “Sin datos disponibles”; el formulario conserva valores solo en el estado frontend y no ofrece guardado ni simula registros.
- La entrada al shell autenticado usa una transición de 200 ms con opacidad y desplazamiento vertical mínimo, desactivada mediante `prefers-reduced-motion`.

## Controles de formulario (UI-04)

- `FormSelect` implementa el patrón accesible combobox/listbox para opciones reutilizables, conservando el valor string del contrato y la opción vacía de selección.
- `FormMultiSelect` extiende el patrón listbox para catálogos de selección múltiple y representa los valores elegidos como chips removibles; debe recibir sus opciones desde servicios, no desde catálogos hardcodeados.
- `DatePicker` presenta un calendario institucional accesible y conserva externamente fechas con formato `YYYY-MM-DD`. Soporta navegación por flechas, Home/End, PageUp/PageDown, selección con Enter/Espacio y cierre con Escape.
- Ambos controles usan los tokens de borde, foco, navy, azul y superficies suaves; mantienen foco visible, estados deshabilitados y reducción de movimiento.

## Flujos de donativos (DON-UI-09)

- Registro usa `/donaciones/registro` y Consulta/Edición usa `/donaciones/detalle?id=<record-id>` dentro del shell autenticado. Los formularios principales dejaron de utilizar overlays modales.
- Ambas páginas comparten un índice derecho con las 10 secciones oficiales, de la 1 a la 10.
- La Sección 6, “Almacenes y Productos”, representa la relación persistente `donativos → incomes → detincomes`. Cada bloque corresponde a una recepción física con productos independientes.
- Los almacenes se presentan como tarjetas plegables con nombre, numeración y contador; cada tarjeta contiene una subárea de productos asociados con tarjetas compactas, resumen monetario y confirmación antes de eliminar datos ingresados.
- Cada producto conserva marca, nombre, cantidad, precio unitario y total calculado. El total se presenta como solo lectura y vuelve a calcularse en backend antes de persistir.
- Los totales derivados de cada almacén y de la donación completa se calculan en centavos, se actualizan con el estado del formulario y se presentan en formato USD; no agregan campos persistentes ni modifican el esquema.
- En escritorio el índice ocupa entre 220 y 250 px y permanece sticky. En laptop y móvil se convierte en un selector accesible sobre el formulario.
- El índice muestra progreso, sección activa y errores de validación confirmados. Cambiar de sección conserva estado, catálogos y archivos seleccionados.
- Registro conserva creación y carga documental; tras un guardado completo actualiza el listado y vuelve a Donativos. Consulta conserva lectura, edición, cancelación sin PATCH, documentos y generación de actas.
- Los diálogos auxiliares de confirmación y los visores autenticados de documentos permanecen disponibles cuando la acción los requiere.
