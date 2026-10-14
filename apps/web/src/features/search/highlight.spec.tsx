import { render } from '@testing-library/react';
import { Highlight } from './highlight';

describe('Highlight', () => {
  it('should wrap the case-insensitive match in <mark> when q matches [AC-13.6]', () => {
    const { container } = render(
      <Highlight text="Vaillant aroTHERM plus 7 kW" query="  AROTHERM " />,
    );

    const marks = container.querySelectorAll('mark');
    expect(Array.from(marks, (m) => m.textContent)).toEqual(['aroTHERM']);
    expect(container.textContent).toBe('Vaillant aroTHERM plus 7 kW');
  });

  it('should mark the umlaut text when q has no diacritics [AC-13.6]', () => {
    const { container } = render(
      <Highlight text="Holzbau & Bedachung Mühlberg" query="muhl" />,
    );

    expect(container.querySelector('mark')?.textContent).toBe('Mühl');
    expect(container.textContent).toBe('Holzbau & Bedachung Mühlberg');
  });

  it('should render markup in the text as plain text when highlighting [AC-13.6]', () => {
    const { container } = render(
      <Highlight text="<b>x</b> <img src=x onerror=alert(1)>" query="x" />,
    );

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(container.textContent).toBe('<b>x</b> <img src=x onerror=alert(1)>');
  });

  it('should render no <mark> when q does not match [AC-13.6]', () => {
    const { container } = render(<Highlight text="Cable NYM-J" query="zz" />);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Cable NYM-J');
  });
});
