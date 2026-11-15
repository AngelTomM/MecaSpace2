# **Crear software de monitorización de la salud para astronautas en misiones espaciales**

Las misiones de larga duración exponen a los astronautas a radiación espacial, aislamiento y confinamiento, gravedad alterada y un entorno cerrado hostil, que puede provocar cambios inmunológicos, pérdida ósea, eventos cardiovasculares y problemas de salud mental. En misiones largas, los astronautas asumen gran parte de la responsabilidad de detectar estos cambios por sí mismos. Tu reto es construir un software de monitorización de la salud que recopile indicadores de salud y permita a los astronautas evaluar y actuar en función del estado de su salud. 

**Transcripción de youtube:** 

| Transcripción Traducida: NASA Space Apps Challenge 2026 Rodrigo Leonardi (Presidente interino de la Agencia Espacial Brasileña) Bienvenidos al NASA Space Apps Challenge 2026\. Soy Rodrigo Leonardi, presidente interino de la Agencia Espacial Brasileña. Nuestra agencia es la autora del siguiente desafío. Crear software de monitoreo de salud para astronautas en misiones espaciales Las misiones de vuelos espaciales tripulados son cada vez más largas y dependientes de la Tierra. El programa Artemis de la NASA, actualmente en curso, ya ha llevado a una tripulación alrededor de la Luna y Marte es el próximo hito. Imagina que estás a mitad de camino a Marte. De repente, un compañero de tripulación siente un dolor agudo en el pecho y colapsa. ¿Qué está pasando? ¿Se está muriendo? ¿Qué deberías hacer en esta situación? El Desafío Crea un software que ayude a los astronautas a evaluar su propia salud y proporcione orientación sobre qué hacer en una situación de emergencia. Piensa de forma original. Recuerda que los astronautas no son médicos. Tu herramienta debe explicar cómo tomar cada medida, por qué es importante y qué hacer cuando un valor no parece normal. Y puedes ir más allá: Recordar a la tripulación que tome mediciones. Adaptarlo a diferentes entornos como una nave espacial, una estación espacial o una base en la superficie de la Luna. Para empezar, explora el programa de investigación humana de la NASA para comprender los riesgos del espacio para el cuerpo humano y los indicadores de salud que son relevantes en este contexto. También puedes utilizar el repositorio de datos de ciencia abierta de la NASA, que recopila datos reales de biología de vuelos espaciales para inspirarte y probar tus ideas. ¿Por qué elegir este desafío? Porque combina ciencia, diseño, habitabilidad espacial y código en un problema que importa para misiones reales en el espacio profundo, salvando vidas potencialmente. Las soluciones que imaginamos hoy podrían ayudar a los astronautas en misiones de exploración espacial y también podrían inspirar herramientas de atención médica aquí en la Tierra para comunidades remotas o lugares con acceso limitado a servicios de salud. El futuro de la exploración espacial necesita tu creatividad. Estamos ansiosos por ver lo que construyen. ¡Buena suerte y bienvenidos al NASA Space Apps Challenge\! Muchas gracias. |
| :---- |

## **Antecedentes**

Con el aumento de la inversión en tecnología e investigación de naves espaciales, las misiones espaciales se han vuelto más ambiciosas. El programa Artemis de la NASA logró recientemente un sobrevuelo lunar tripulado, y la NASA y otros tienen planes de enviar humanos a Marte en el futuro. Con misiones cada vez más largas, los astronautas estarán más expuestos al entorno espacial hostil, que conlleva riesgos tanto físicos como mentales.

El Programa de Investigación Humana de la NASA ha cartografiado los **cinco peligros** del vuelo espacial humano, que son: 

1. la radiación espacial  
2. el aislamiento y confinamiento  
3. la distancia a la Tierra  
4. los campos gravitacionales  
5. los entornos cerrados hostiles. 

Estos **riesgos** pueden contribuir a **problemas de salud** como:

* cambios en el sistema inmunitario  
* pérdida de densidad ósea  
* eventos cardiovasculares  
* nutrición inadecuada  
* trastornos de salud conductual y otros.

Los astronautas deben ser capaces de realizar evaluaciones de salud durante una misión, para prevenir y tratar los problemas de salud que puedan surgir. 

Algunos indicadores útiles para la salud son: 

* la presión arterial  
* la frecuencia cardíaca  
* el azúcar en sangre  
* la temperatura corporal  
* las horas diarias de sueño  
* el estado de ánimo.

## **Objetivos**

Tu reto es crear una herramienta visual que **ayude** a los astronautas a **evaluar** su propia salud durante las misiones espaciales y que **ofrezca orientación** sobre tratamientos y mejoras en la salud. 

Puedes considerar recopilar datos del usuario mediante cualquier tipo de entrada—texto de teclado, clics de ratón o imágenes de cámara, por ejemplo. Se puede utilizar cualquier tipo de dato, **siempre que representen un indicador de salud**, como los niveles de azúcar en sangre en mg/dL o imágenes de ecografía.

Puedes utilizar los recursos del Programa de Investigación Humana de la NASA, junto con los recursos públicos de otras agencias espaciales, para entender cómo afectan los peligros de los vuelos espaciales a la salud humana y decidir qué indicadores son útiles y cómo pueden respaldar una evaluación rápida. ¿Qué mediciones se pueden realizar en el espacio? ¿Por qué es necesario un examen? ¿Cómo afectan los peligros del vuelo espacial a estos indicadores de salud? ¿Cuándo podría un resultado merecer la atención de la tripulación o de los médicos de vuelo en tierra? ¿Qué acciones se pueden tomar para prevenir una condición de salud crítica? Estas son preguntas que merece la pena considerar mientras desarrollas tu solución.

El diseño de la interfaz de usuario desempeña un papel importante en la presentación clara de métricas y diagnósticos. Podrías considerar aprovechar las animaciones y la interactividad para presentar la información. Por ejemplo, el software podría mostrar una figura humana donde cada parte del cuerpo es clicable y muestra información sobre su función y estado de salud.

## **Consideraciones potenciales**

*Puedes (aunque no estás obligado) considerar lo siguiente:*

* Tu herramienta podría proporcionar información sobre la salud de astronautas en diferentes entornos, como una nave espacial, una estación espacial, un rover o una base en otro planeta o luna.  
* Tu herramienta podría pedir a los astronautas que tomen mediciones o realicen acciones específicas de vez en cuando como parte de la rutina de la misión.  
* Tu herramienta podría incluir las siguientes características:  
  * Un sistema de gamificación para ayudar a los astronautas a realizar tareas que apoyen su salud  
  * Gráficos dinámicos que muestran cómo cambian los indicadores de salud de los astronautas a lo largo del tiempo  
  * Codificación por colores que ayuda al astronauta a interpretar el estado de un indicador de salud de un vistazo  
* No des por hecho que los astronautas saben todo sobre cómo evaluar su salud. Tu herramienta podría proporcionar instrucciones y explicaciones sencillas que cubran mediciones, indicadores de salud y riesgos.

# Recursos:

*responsable de la información contenida en entidades no estadounidenses. Sitios web gubernamentales. Para los que no son estadounidenses, Sitios web gubernamentales, los participantes deben cumplir con cualquier parámetro de uso de datos de ese sitio web específico.*

## **Datos y Recursos de la NASA**

[**5 Peligros del vuelo espacial tripulado**](https://www.nasa.gov/hrp/hazards/)**:** Información básica del programa de investigación humana de la NASA sobre los principales peligros que afectan a las personas en misiones espaciales. También proporciona enlaces a artículos y reportajes detallados de la NASA relacionados con un peligro específico.

[**Riesgos del vuelo espacial humano**](https://www.nasa.gov/hrp/risks/)**:** Información básica del programa de investigación humana de la NASA sobre los principales riesgos a los que se enfrentan los humanos en misiones espaciales. También proporciona enlaces a artículos y reportajes detallados de la NASA relacionados con un riesgo específico.

[**Investigación HRP en curso en el espacio**](https://www.nasa.gov/hrp/ongoing-hrp-research/)**:** Artículos de investigaciones en curso sobre el programa de investigación humana de la NASA.

## **Recursos para socios de la Agencia Espacial**

**CSA (Agencia Espacial Canadiense)**

[**Monitorización de la radiación para la salud de los astronautas**](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)**:** Descubre cómo la CSA está ayudando a monitorizar la radiación espacial para proteger mejor la salud de los astronautas durante misiones de larga duración. Este recurso destaca tecnologías e investigaciones canadienses utilizadas para medir la exposición a la radiación en el espacio y mejorar nuestra comprensión de sus efectos en el cuerpo humano.

[**¿Por qué realizamos experimentos científicos en el espacio?**](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)**:** Este recurso de la CSA explica cómo el entorno único del espacio permite a los científicos realizar experimentos que no pueden realizarse en la Tierra. Descubre cómo la investigación a bordo de la Estación Espacial Internacional avanza en nuestra comprensión de la salud humana, la tecnología y el universo. Los descubrimientos realizados en el espacio ayudan a mejorar la vida en la Tierra mientras apoyan futuras misiones de exploración.  
