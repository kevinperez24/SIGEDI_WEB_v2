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
