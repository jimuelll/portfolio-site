const verticalPositions = Array.from({ length: 25 }, (_, index) => (index / 24) * 100);
const horizontalPositions = Array.from({ length: 17 }, (_, index) => (index / 16) * 100);

export function RippleGrid() {
  return (
    <div className="ripple-field" aria-hidden="true">
      <svg className="ripple-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
        {verticalPositions.map((position) => <path d={`M ${position} 0 V 100`} key={`v-${position}`} />)}
        {horizontalPositions.map((position) => <path d={`M 0 ${position} H 100`} key={`h-${position}`} />)}
      </svg>
    </div>
  );
}
