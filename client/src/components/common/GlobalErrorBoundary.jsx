import { Component, createRef } from 'react';
import { useTranslation } from 'react-i18next';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
    this.headingRef = createRef();
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Unexpected render failure', {
        name: error?.name ?? 'Error',
        componentStack: info?.componentStack?.slice(0, 2_000),
      });
    }
    window.setTimeout(() => this.headingRef.current?.focus(), 0);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { title, detail, reloadLabel } = this.props;
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas p-4 text-primary">
        <section className="card w-full max-w-lg text-center" role="alert" aria-labelledby="unexpected-error-title">
          <h1 id="unexpected-error-title" ref={this.headingRef} tabIndex="-1" className="text-xl font-semibold outline-none">
            {title}
          </h1>
          <p className="mt-2 text-sm text-secondary">{detail}</p>
          <button type="button" className="btn-primary mt-5 min-h-11" onClick={() => window.location.reload()}>
            {reloadLabel}
          </button>
        </section>
      </main>
    );
  }
}

export function GlobalErrorBoundary({ children }) {
  const { t } = useTranslation();
  return (
    <AppErrorBoundary
      title={t('errors.unexpectedTitle')}
      detail={t('errors.unexpectedDetail')}
      reloadLabel={t('errors.reloadPage')}
    >
      {children}
    </AppErrorBoundary>
  );
}
