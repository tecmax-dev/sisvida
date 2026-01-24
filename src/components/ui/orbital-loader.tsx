"use client"

import React from "react"
import { cva } from "class-variance-authority"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const orbitalLoaderVariants = cva("flex gap-2 items-center justify-center", {
  variants: {
    messagePlacement: {
      bottom: "flex-col",
      top: "flex-col-reverse",
      right: "flex-row",
      left: "flex-row-reverse",
    },
  },
  defaultVariants: {
    messagePlacement: "bottom",
  },
})

export interface OrbitalLoaderProps {
  message?: string
  /**
   * Position of the message relative to the spinner.
   * @default bottom
   */
  messagePlacement?: "top" | "bottom" | "left" | "right"
}

export function OrbitalLoader({
  className,
  message,
  messagePlacement,
  ...props
}: React.ComponentProps<"div"> & OrbitalLoaderProps) {
  return (
    <div
      className={cn(orbitalLoaderVariants({ messagePlacement }), className)}
      {...props}
    >
      <div className="relative flex items-center justify-center w-12 h-12">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute inset-1 rounded-full border-2 border-transparent border-t-primary/60"
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary/30"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
