import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlMd } from "@/lib/fieldStyles"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldControlMd,
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
