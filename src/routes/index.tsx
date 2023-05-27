import { component$, useSignal } from '@builder.io/qwik';
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Signal } from '@builder.io/qwik';

const mockValues = {
  page: {
    width: 8.5,
    height: 11,
    padding: 0.5,
  },
  images:
    [
      {
        src: '/photo.png',
        width: 6,
        height: 6
      },
      {
        src: '/photo2.png',
        width: 5,
        height: 5
      }
    ],
}

const Page = component$(({ width, values, offscreen }: { width: string, values: typeof mockValues, offscreen?: Signal<HTMLElement> }) => {
  const offscreenStyle = {
    left: `-200vmax`,
    top: `-200vmax`,
    position: 'absolute',
    pointerEvents: 'none'
  }
  const offscreenAttributes = {
    'aria-hidden': true,
    ref: offscreen
  }
  return <div
    {...(offscreen ? offscreenAttributes : {})}
    style={{
      display: 'inline-block',
      width,
      aspectRatio: `${values.page.width} / ${values.page.height}`,
      // padding: `calc(${values.page.padding} / ${values.page.width} * 100%)`,
      background: 'white',
      minHeight: 0,
      ...(offscreen ? offscreenStyle : {})
    }}>
    {values.images.map(image => {
      return <img key={image.src} src={image.src} style={{ width: `calc(${image.width} / ${values.page.width} * 100%)`, aspectRatio: `${image.width} / ${image.height}` }} />
    })}
  </div>
})

export default component$(() => {
  const content = useSignal<HTMLDivElement>(null!)

  return (
    <>
      <button style="margin-bottom: 1rem;" onClick$={async () => {
        const doc = new jsPDF({
          unit: 'in',
          orientation: 'p',
          format: [8.5, 11]
        });
        const canvas = await html2canvas(content.value!)
        doc.addImage(canvas, 0, 0, 8.5, 11)
        doc.save('canvas.pdf')
      }}>Download</button>

      <div>
        <Page width='80%' values={mockValues} />
        <Page width='8.5in' values={mockValues} offscreen={content} />
      </div>
    </>
  );
});
