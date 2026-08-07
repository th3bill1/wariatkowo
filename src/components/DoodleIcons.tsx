import type { CSSProperties, ReactNode } from 'react';

type IconProps = {
  className?: string;
  style?: CSSProperties;
};

function SvgFrame({
  children,
  className,
  style,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {children}
    </svg>
  );
}

export function CoffeeIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* cup */}
      <path
        d="M20 36h45v22c0 11-9 20-20 20h-5c-11 0-20-9-20-20V36Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* handle */}
      <path
        d="M65 42h6c7 0 11 5 11 11s-4 11-11 11h-7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* steam */}
      <path
        d="M31 27c-4-4 3-7 0-12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M44 27c-4-4 3-7 0-12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M57 27c-4-4 3-7 0-12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </SvgFrame>
  );
}

export function PlantIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* pot */}
      <path
        d="M29 60h38l-5 21H34l-5-21Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* stem */}
      <path
        d="M48 60V33"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* leaves */}
      <path
        d="M47 45C35 44 28 37 29 26c11 0 18 7 18 19Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <path
        d="M49 39c2-12 10-19 21-18-1 11-8 18-21 18Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <path
        d="M49 54c8-9 17-11 26-6-5 10-14 13-26 6Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </SvgFrame>
  );
}

export function PawIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* toes */}
      <ellipse cx="29" cy="35" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="43" cy="27" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="57" cy="27" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="70" cy="36" rx="8" ry="10" fill="currentColor" />

      {/* main pad */}
      <path
        d="M27 65c0-12 10-23 21-23s22 11 22 23c0 10-7 16-15 13-4-2-10-2-14 0-8 3-14-3-14-13Z"
        fill="currentColor"
      />
    </SvgFrame>
  );
}

export function PizzaIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* slice */}
      <path
        d="M24 30 73 35 45 82 24 30Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* crust */}
      <path
        d="M23 30c13-8 35-6 51 5"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* pepperoni */}
      <circle cx="43" cy="45" r="5" fill="currentColor" />
      <circle cx="55" cy="54" r="5" fill="currentColor" />
      <circle cx="43" cy="64" r="4" fill="currentColor" />
    </SvgFrame>
  );
}

export function HouseIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* house body */}
      <path
        d="M25 43 48 23l23 20v35H25V43Z"
        fill="currentColor"
        fillOpacity="0.09"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* roof */}
      <path
        d="M17 48 48 20l31 28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* door */}
      <path
        d="M40 78V56h16v22"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* window */}
      <rect
        x="29"
        y="51"
        width="9"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="3"
      />
    </SvgFrame>
  );
}

export function HeartIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      <path
        d="M48 79 22 54C7 39 17 18 34 18c7 0 12 4 14 10 2-6 7-10 14-10 17 0 27 21 12 36L48 79Z"
        fill="currentColor"
        fillOpacity="0.17"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </SvgFrame>
  );
}

export function SuitcaseIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* case */}
      <rect
        x="20"
        y="34"
        width="56"
        height="45"
        rx="8"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="4"
      />

      {/* handle */}
      <path
        d="M37 34v-7c0-5 4-8 8-8h6c5 0 8 3 8 8v7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* straps */}
      <path
        d="M34 35v43M62 35v43"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* sticker */}
      <circle
        cx="48"
        cy="57"
        r="6"
        stroke="currentColor"
        strokeWidth="3"
      />
    </SvgFrame>
  );
}

export function DoodleDogIcon({ className, style }: IconProps) {
  return (
    <SvgFrame className={className} style={style}>
      {/* ears */}
      <path
        d="M32 33c-9-10-17-7-14 8 2 8 7 13 14 14"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      <path
        d="M64 33c9-10 17-7 14 8-2 8-7 13-14 14"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* head */}
      <path
        d="M27 45c0-15 9-24 21-24s21 9 21 24v11c0 14-9 23-21 23s-21-9-21-23V45Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* eyes */}
      <circle cx="39" cy="48" r="3" fill="currentColor" />
      <circle cx="57" cy="48" r="3" fill="currentColor" />

      {/* muzzle */}
      <ellipse
        cx="48"
        cy="61"
        rx="11"
        ry="9"
        fill="currentColor"
        fillOpacity="0.1"
      />

      {/* nose */}
      <path
        d="M43 58c2-3 8-3 10 0-1 4-3 6-5 6s-4-2-5-6Z"
        fill="currentColor"
      />

      {/* mouth */}
      <path
        d="M48 64c-1 5-5 7-8 7M48 64c1 5 5 7 8 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </SvgFrame>
  );
}