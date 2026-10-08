/** Two glass phones. When `live`, they swing together and a ring spreads from where they meet. */
export function TapStage({ live }: { live?: boolean }) {
  return (
    <div className="tap-stage" data-live={live ? "" : undefined} aria-hidden="true">
      <span className="tap-ring" /><span className="tap-ring two" />
      <span className="tap-phone glass a" /><span className="tap-phone glass b" />
    </div>
  );
}
