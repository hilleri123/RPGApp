from typing import Optional
from pydantic import BaseModel, NonNegativeInt, model_validator

class MasteryRules(BaseModel):
    noviceAt: NonNegativeInt = 0
    trainedAt: Optional[NonNegativeInt] = None
    masterAt: Optional[NonNegativeInt] = None
    legendAt: Optional[NonNegativeInt] = None
    note: str = "Mastery is computed by tag matches (character tags + equipped/tools + passives)."

    @model_validator(mode="after")
    def _check_chain(self):
        # цепочка без дыр
        if self.masterAt is not None and self.trainedAt is None:
            raise ValueError("masterAt requires trainedAt")
        if self.legendAt is not None and self.masterAt is None:
            raise ValueError("legendAt requires masterAt")

        # порядок слева-направо
        vals = [("noviceAt", self.noviceAt), ("trainedAt", self.trainedAt), ("masterAt", self.masterAt), ("legendAt", self.legendAt)]
        prev_name, prev = vals[0][0], int(vals[0][1])
        for name, v in vals[1:]:
            if v is None:
                break
            v_int = int(v)
            if v_int <= prev:
                raise ValueError(f"{name} must be > {prev_name}")
            prev_name, prev = name, v_int
        return self
