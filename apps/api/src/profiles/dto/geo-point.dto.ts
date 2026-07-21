import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber } from "class-validator";

export class GeoPointDto {
  @IsIn(["Point"])
  type!: "Point";

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}
